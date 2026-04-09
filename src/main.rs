mod hook;
mod render;
mod server;

use clap::Parser;
use hook::{HookInput, HookOutput};
use server::Decision;

#[derive(Parser, Debug)]
#[command(version, about = "Claude Code plan reviewer hook binary")]
struct Args {
    /// Skip opening the browser and print the review URL to stderr only
    #[arg(long, default_value_t = false)]
    no_browser: bool,
}

fn main() {
    // 1. Parse CLI args
    let args = Args::parse();

    // 2. Read all of stdin synchronously (before any async runtime)
    let input_json = match std::io::read_to_string(std::io::stdin()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to read stdin: {}", e);
            std::process::exit(1);
        }
    };

    // 3. Parse JSON into HookInput
    let hook_input: HookInput = serde_json::from_str(&input_json).unwrap_or_else(|e| {
        eprintln!("Failed to parse hook input: {}", e);
        std::process::exit(1);
    });

    // 4. Render plan markdown to HTML
    let plan_md = hook_input.tool_input.plan.unwrap_or_default();
    let plan_html = render::render_plan_html(&plan_md);
    eprintln!("Plan rendered ({} bytes HTML)", plan_html.len());

    // 5. Start tokio runtime (current_thread for single-user tool)
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let output = rt.block_on(async_main(args, plan_html));

    // 6. Write decision to stdout — THE ONLY stdout write
    serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
}

async fn async_main(args: Args, plan_html: String) -> HookOutput {
    // Start server
    let (port, decision_rx) = match server::start_server(plan_html).await {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Failed to start server: {}", e);
            return HookOutput::deny(format!("Internal error: {}", e));
        }
    };

    let url = format!("http://127.0.0.1:{}", port);

    // Always print URL to stderr (UI-06)
    eprintln!("Review UI: {}", url);

    // Open browser unless --no-browser (CONF-02)
    if !args.no_browser {
        if let Err(e) = webbrowser::open(&url) {
            eprintln!("Failed to open browser: {}", e);
            eprintln!("Open manually: {}", url);
        }
    }

    // Race: user decision vs timeout (540 seconds, per D-07)
    const TIMEOUT_SECS: u64 = 540;

    let decision = tokio::select! {
        result = decision_rx => {
            match result {
                Ok(d) => d,
                Err(_) => {
                    eprintln!("Decision channel closed unexpectedly");
                    Decision {
                        behavior: "deny".to_string(),
                        message: Some("Internal error: decision channel closed".to_string()),
                    }
                }
            }
        }
        _ = tokio::time::sleep(std::time::Duration::from_secs(TIMEOUT_SECS)) => {
            eprintln!("Review timed out after {} seconds", TIMEOUT_SECS);
            Decision {
                behavior: "deny".to_string(),
                message: Some("Review timed out \u{2014} plan was not approved".to_string()),
            }
        }
    };

    // Spawn 3-second watchdog for clean exit (HOOK-04)
    tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        std::process::exit(0);
    });

    // Convert Decision to HookOutput
    match decision.behavior.as_str() {
        "allow" => HookOutput::allow(),
        "deny" => HookOutput::deny(
            decision
                .message
                .unwrap_or_else(|| "Denied without message".to_string()),
        ),
        other => {
            eprintln!("Unknown decision behavior: {}", other);
            HookOutput::deny(format!("Unknown behavior: {}", other))
        }
    }
}
