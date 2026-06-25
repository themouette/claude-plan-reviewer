// plan-reviewer-pi.ts
// plan-reviewer-version: __PLAN_REVIEWER_VERSION__
// Installed by plan-reviewer. Binary path injected at install time.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const PLAN_REVIEWER_BIN = "__PLAN_REVIEWER_BIN__";

const SYSTEM_PROMPT_INJECTION = `Before taking any action or running any commands, you MUST:
1. Write a detailed markdown plan describing what you intend to do and how.
   Save it to a file (e.g., /tmp/plan-<short-description>.md).
2. Call the plan_reviewer_submit_plan tool with the file path.
3. Wait for the tool to return before proceeding.

If the tool returns an approval message, proceed with execution.
If the tool returns a denial message, revise the plan based on the feedback
and resubmit before doing any work.

Do NOT execute any commands or make any changes until the plan has been
explicitly approved through plan_reviewer_submit_plan.`;

export default function planReviewer(pi: any): void {
  pi.registerTool("plan_reviewer_submit_plan", {
    description:
      "Submit a plan file for human review before implementation. The reviewer opens a browser UI where the user can approve, deny, or annotate the plan.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "Path to the markdown plan file to submit for review",
        },
      },
      required: ["filePath"],
    },
    execute: ({ filePath }: { filePath: string }) => {
      const content = readFileSync(filePath, "utf-8");
      const stdinJson = JSON.stringify({
        tool_name: "exit_plan_mode",
        tool_input: { plan: content },
      });
      try {
        const stdout = execFileSync(PLAN_REVIEWER_BIN, ["review-hook"], {
          input: stdinJson,
          encoding: "utf-8",
          timeout: 600000,
        });
        const result = JSON.parse((stdout as string).trim());
        if (result.behavior === "allow") {
          return "Plan APPROVED by reviewer.";
        } else {
          return `Plan DENIED by reviewer. Feedback:\n${
            result.message || "No message provided."
          }`;
        }
      } catch (err: any) {
        return `Plan review failed: ${err.message}`;
      }
    },
  });

  pi.on("before_agent_start", () => {
    return SYSTEM_PROMPT_INJECTION;
  });
}
