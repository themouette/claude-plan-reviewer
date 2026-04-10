// plan-reviewer-opencode.mjs
// plan-reviewer-version: __PLAN_REVIEWER_VERSION__
// Installed by plan-reviewer. Binary path injected at install time.
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const PLAN_REVIEWER_BIN = "__PLAN_REVIEWER_BIN__";

export default (ctx) => {
  return {
    tool: {
      submit_plan: {
        description:
          "Submit a plan for human review before implementation. The reviewer opens a browser UI where the user can approve, deny, or annotate the plan.",
        parameters: {
          type: "object",
          properties: {
            plan: {
              type: "string",
              description:
                "The complete plan markdown text to submit for review",
            },
          },
          required: ["plan"],
        },
        execute: async ({ plan }) => {
          const tmpFile = join(
            tmpdir(),
            `plan-reviewer-${randomUUID()}.md`
          );
          try {
            writeFileSync(tmpFile, plan, "utf-8");
            const stdout = execFileSync(
              PLAN_REVIEWER_BIN,
              ["--plan-file", tmpFile],
              {
                encoding: "utf-8",
                timeout: 600000,
                cwd: process.cwd(),
              }
            );
            const result = JSON.parse(stdout.trim());
            if (result.behavior === "allow") {
              return "Plan APPROVED by reviewer.";
            } else {
              return `Plan DENIED by reviewer. Feedback:\n${
                result.message || "No message provided."
              }`;
            }
          } catch (err) {
            return `Plan review failed: ${err.message}`;
          } finally {
            try {
              unlinkSync(tmpFile);
            } catch {}
          }
        },
      },
    },
  };
};
