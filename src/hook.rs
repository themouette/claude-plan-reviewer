use serde::{Deserialize, Serialize};

// --- Input (stdin) ---

#[derive(Deserialize, Debug)]
pub struct HookInput {
    #[allow(dead_code)]
    pub session_id: String,
    #[allow(dead_code)]
    pub transcript_path: Option<String>,
    pub cwd: String,
    pub hook_event_name: String,
    #[allow(dead_code)]
    pub tool_name: String,
    pub tool_input: ToolInput,
}

impl HookInput {
    /// Returns true if this hook was invoked by Gemini CLI (BeforeTool event).
    pub fn is_gemini(&self) -> bool {
        self.hook_event_name == "BeforeTool"
    }
}

#[derive(Deserialize, Debug)]
pub struct ToolInput {
    pub plan: Option<String>,      // Claude Code: inline plan text
    pub plan_path: Option<String>, // Gemini CLI: path to plan .md file
    #[serde(flatten)]
    #[allow(dead_code)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

// --- Output (stdout) ---

#[derive(Serialize, Debug)]
pub struct HookOutput {
    #[serde(rename = "hookSpecificOutput")]
    pub hook_specific_output: HookSpecificOutput,
}

#[derive(Serialize, Debug)]
pub struct HookSpecificOutput {
    #[serde(rename = "hookEventName")]
    pub hook_event_name: String,
    pub decision: PermissionDecision,
}

#[derive(Serialize, Debug)]
pub struct PermissionDecision {
    pub behavior: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl HookOutput {
    pub fn allow() -> Self {
        HookOutput {
            hook_specific_output: HookSpecificOutput {
                hook_event_name: "PermissionRequest".to_string(),
                decision: PermissionDecision {
                    behavior: "allow".to_string(),
                    message: None,
                },
            },
        }
    }

    pub fn deny(message: String) -> Self {
        HookOutput {
            hook_specific_output: HookSpecificOutput {
                hook_event_name: "PermissionRequest".to_string(),
                decision: PermissionDecision {
                    behavior: "deny".to_string(),
                    message: Some(message),
                },
            },
        }
    }
}
