import * as vscode from "vscode"
import { ExtensionState } from "./state"
import { toMarkdownString } from "./markdown"
import { CHANGE } from "coarch-core"
import { Utils } from "vscode-uri"
import { commandButtons } from "./promptcommands"

function toStringList(...token: string[]) {
    const md = token.filter((l) => l !== undefined && l !== null).join(", ")
    return md
}

export function activateStatusBar(state: ExtensionState) {
    const { context, host } = state

    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        120
    )
    statusBarItem.command = "coarch.request.status"
    const updateStatusBar = async () => {
        const { computing, progress, options, editsApplied } =
            state.aiRequest || {}
        const { template, fragment } = options || {}
        const { tokensSoFar } = progress || {}
        const token = await host.getSecretToken()
        statusBarItem.text = toStringList(
            "GPTools",
            computing && !tokensSoFar ? `$(loading~spin)` : undefined,
            tokensSoFar ? `${tokensSoFar} tokens` : undefined
        )

        const cmds = commandButtons(state)
        const md = new vscode.MarkdownString(
            toMarkdownString(
                fragment
                    ? Utils.basename(vscode.Uri.file(fragment.file.filename))
                    : undefined,
                template
                    ? `-  tool: ${template.title} (${template.id})`
                    : undefined,
                `-   OpenAI token: ${
                    token
                        ? `${token.url} [clear](command:coarch.openai.token.clear)`
                        : "not configured"
                }`,
                "",
                cmds
                    .map(({ title, cmd }) => `[${title}](command:${cmd})`)
                    .join(" | ")
            ),
            true
        )
        md.isTrusted = true
        statusBarItem.tooltip = md
    }

    state.addEventListener(CHANGE, updateStatusBar)

    updateStatusBar()
    context.subscriptions.push(statusBarItem)
    statusBarItem.show()
}
