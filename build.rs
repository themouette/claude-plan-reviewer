fn main() {
    // Gate: skip frontend build when SKIP_FRONTEND_BUILD is set
    // (useful for CI cross-compilation where npm is not available)
    if std::env::var("SKIP_FRONTEND_BUILD").is_ok() {
        return;
    }

    let ui_dir = concat!(env!("CARGO_MANIFEST_DIR"), "/ui");

    // Run npm install (ensure deps are present)
    let install_status = std::process::Command::new("npm")
        .args(["install"])
        .current_dir(ui_dir)
        .status()
        .expect("failed to run npm install — is Node.js installed?");
    if !install_status.success() {
        panic!("npm install failed in ui/");
    }

    // Run npm run build
    let build_status = std::process::Command::new("npm")
        .args(["run", "build"])
        .current_dir(ui_dir)
        .status()
        .expect("failed to run npm run build — is Node.js installed?");
    if !build_status.success() {
        panic!("npm run build failed in ui/");
    }

    // Tell cargo to re-run this script if frontend sources change
    println!("cargo:rerun-if-changed=ui/src");
    println!("cargo:rerun-if-changed=ui/index.html");
    println!("cargo:rerun-if-changed=ui/package.json");
    println!("cargo:rerun-if-changed=ui/vite.config.ts");
}
