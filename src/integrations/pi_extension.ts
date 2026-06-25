// plan-reviewer-pi.ts
// plan-reviewer-version: __PLAN_REVIEWER_VERSION__
// Installed by plan-reviewer. Binary path injected at install time.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Type } from "typebox";

const PLAN_REVIEWER_BIN = "__PLAN_REVIEWER_BIN__";
const PLAN_REVIEWER_COMMAND = shellQuote(PLAN_REVIEWER_BIN);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function sendCommandPrompt(pi: any, ctx: any, prompt: string, queuedMessage: string): void {
  if (ctx.isIdle()) {
    pi.sendUserMessage(prompt);
  } else {
    pi.sendUserMessage(prompt, { deliverAs: "followUp" });
    ctx.ui.notify(queuedMessage, "info");
  }
}

function buildAnnotatePrompt(args: string): string {
  const trimmedArgs = args.trim();
  const explicitArgument = trimmedArgs
    ? `The user provided this explicit target argument: ${trimmedArgs}`
    : "The user did not provide an explicit target argument.";

  return `Open a markdown file in the plan-reviewer browser UI. Treat the result as feedback collection, not an approval gate.

${explicitArgument}

Resolve the target file using these rules in order:

1. If the user provided an explicit target argument, use it as the file path.
2. Otherwise, use the most recent markdown file mentioned in the conversation.
3. If no markdown file is available, write your last full response to a temporary \`.md\` file and use that path.

Tell the user which file you are opening, then run this with the bash tool:

\`\`\`bash
${PLAN_REVIEWER_COMMAND} review --approve-label "No issues" --deny-label "Leave feedback" <resolved-file>
\`\`\`

If stdout contains \`{"behavior":"allow"}\`, say: \`Review complete, no comments.\`

If stdout contains \`{"behavior":"deny","message":"<feedback>"}\`, say: \`Feedback received: <feedback>\` and treat it as revision instructions.

If there is no stdout, ask the user whether they copied a JSON decision from the browser UI.`;
}

const CODE_REVIEW_PROMPT = `Open the diff viewer for the current git branch in the plan-reviewer browser UI.
Use this before creating a PR to review and annotate the changes.

Run this with the bash tool:

\`\`\`bash
${PLAN_REVIEWER_COMMAND} code-review
\`\`\`

If stdout contains \`{"behavior":"allow"}\`, say: \`Review complete, proceeding with PR creation.\`

If stdout contains \`{"behavior":"deny","message":"<feedback>"}\`, say: \`Review feedback received: <feedback>\` and address it before creating the PR.

If there is no stdout, say: \`The code review process exited without a result.\` and ask whether to proceed.`;

const SYSTEM_PROMPT_INJECTION = `Before starting implementation work, you MUST:
1. Write a detailed markdown plan describing what you intend to implement and how.
   Save it to a file (e.g., /tmp/plan-<short-description>.md).
2. Call the plan_reviewer_submit_plan tool with the file path.
3. Wait for the tool to return before implementing changes.

Implementation work means creating, editing, or deleting files; applying patches;
or carrying out a planned multi-step change. Do not call
plan_reviewer_submit_plan for read-only inspection, answering questions, running
a single explicit user-requested command, or opening the plan-reviewer
code-review UI itself.

If the tool returns an approval message, proceed with the implementation.
If the tool returns a denial message, revise the plan based on the feedback
and resubmit before implementing changes.

Do NOT make repository changes until the implementation plan has been explicitly
approved through plan_reviewer_submit_plan.`;

export default function planReviewer(pi: any): void {
  pi.registerCommand("plan-reviewer:annotate", {
    description: "Open a markdown file in the plan-reviewer browser UI for feedback",
    handler: async (args: string, ctx: any) => {
      sendCommandPrompt(
        pi,
        ctx,
        buildAnnotatePrompt(args),
        "Queued plan-reviewer annotation request.",
      );
    },
  });

  pi.registerCommand("plan-reviewer:code-review", {
    description: "Open the code review UI for the current git branch",
    handler: async (_args: string, ctx: any) => {
      sendCommandPrompt(
        pi,
        ctx,
        CODE_REVIEW_PROMPT,
        "Queued plan-reviewer code review request.",
      );
    },
  });

  pi.registerTool({
    name: "plan_reviewer_submit_plan",
    label: "Plan Review",
    description:
      "Submit a markdown plan file for human review before implementation. The reviewer opens a browser UI where the user can approve, deny, or annotate the plan.",
    promptSnippet: "Submit a markdown plan file for human approval before implementation.",
    promptGuidelines: [
      "Use plan_reviewer_submit_plan before implementation work that changes files or carries out a planned multi-step change. Do not use it for read-only inspection, answering questions, single explicit no-change commands, or opening the code-review UI itself.",
    ],
    parameters: Type.Object({
      filePath: Type.String({
        description: "Path to the markdown plan file to submit for review",
      }),
    }),
    async execute(_toolCallId: string, params: { filePath: string }) {
      const filePath = params.filePath.replace(/^@/, "");
      try {
        readFileSync(filePath, "utf-8");
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Plan review failed: could not read plan file at '${filePath}': ${err.message}`,
            },
          ],
          details: { approved: false, error: err.message },
        };
      }
      try {
        const stdout = execFileSync(PLAN_REVIEWER_BIN, ["review", filePath], {
          encoding: "utf-8",
          timeout: 600000,
        });
        const result = JSON.parse((stdout as string).trim());
        if (result.behavior === "allow") {
          return {
            content: [{ type: "text", text: "Plan APPROVED by reviewer." }],
            details: { approved: true },
          };
        }
        return {
          content: [
            {
              type: "text",
              text: `Plan DENIED by reviewer. Feedback:\n${
                result.message || "No message provided."
              }`,
            },
          ],
          details: { approved: false, message: result.message || null },
          terminate: true,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Plan review failed: ${err.message}` }],
          details: { approved: false, error: err.message },
        };
      }
    },
  });

  pi.on("before_agent_start", (event: any) => {
    return {
      systemPrompt: `${event.systemPrompt}\n\n${SYSTEM_PROMPT_INJECTION}`,
    };
  });
}
