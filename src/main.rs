mod hook;
mod render;

use clap::Parser;
use hook::{HookInput, HookOutput};

#[derive(Parser, Debug)]
#[command(version, about = "Claude Code plan reviewer hook binary")]
struct Args {
    /// Skip opening the browser and print the review URL to stderr only
    #[arg(long, default_value_t = false)]
    no_browser: bool,
}

fn main() {
    // 1. Parse CLI args first
    let _args = Args::parse();

    // 2. Read all of stdin synchronously (before any async runtime)
    let input_json = match std::io::read_to_string(std::io::stdin()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error reading stdin: {}", e);
            std::process::exit(1);
        }
    };

    // 3. Parse JSON into HookInput
    let hook_input: HookInput = match serde_json::from_str(&input_json) {
        Ok(h) => h,
        Err(e) => {
            eprintln!("Error parsing hook input JSON: {}", e);
            std::process::exit(1);
        }
    };

    // 4. Extract plan markdown (use empty string if None)
    let plan_markdown = hook_input.tool_input.plan.unwrap_or_default();

    // 5. Render plan markdown to HTML via comrak
    let html = render::render_plan_html(&plan_markdown);
    eprintln!("Plan rendered ({} bytes HTML)", html.len());

    // 6. Write hardcoded allow response to stdout — the ONLY stdout write
    if let Err(e) = serde_json::to_writer(std::io::stdout(), &HookOutput::allow()) {
        eprintln!("Error writing hook output: {}", e);
        std::process::exit(1);
    }
}
