import { describe, test } from "node:test"
import assert from "node:assert/strict"
import { CLI_JS } from "genaiscript-core"
import "zx/globals"

const cli = `../cli/built/${CLI_JS}`

describe("run", () => {
    const cmd = "run"
    describe("dry run", () => {
        const flags = `--prompt`
        test("slides greeter", async () => {
            const res =
                await $`node ${cli} ${cmd} slides src/greeter.ts ${flags}`
            const resj = JSON.parse(res.stdout)
            assert(Array.isArray(resj))
            assert(
                resj.some(
                    (msg) =>
                        msg.role === "user" &&
                        msg.content[0].text.includes("src/greeter.ts")
                )
            )
        })
    })
})

describe("scripts", () => {
    const cmd = "scripts"
    test("list", async () => {
        const res = await $`node ${cli} ${cmd}`
        assert(
            res.stdout.includes(
                "system.json, JSON system prompt, system, builtin, system"
            )
        )
    })
})

describe("cli", () => {
    test("help-all", async () => {
        await $`node ${cli} help-all`
    })
})

describe("parse", () => {
    const cmd = "parse"
    test("pdf", async () => {
        const res = await $`node ${cli} ${cmd} pdf src/rag/loremipsum.pdf`
        assert(res.stdout.includes("Lorem Ipsum"))
    })
    test("docx", async () => {
        const res = await $`node ${cli} ${cmd} docx src/rag/Document.docx`
        assert(
            res.stdout.includes(
                "Microsoft Word is a word processor developed by Microsoft."
            )
        )
    })
    test("tokens", async () => {
        const res = await $`node ${cli} ${cmd} tokens "**/*.md"`
    })
    describe("code", () => {
        const action = "code"
        test("greeter.ts query", async () => {
            const res =
                await $`node ${cli} ${cmd} ${action} src/greeter.ts "(interface_declaration) @i"`
            assert(res.stdout.includes("interface_declaration"))
        })
        test("greeter.ts tree", async () => {
            const res =
                await $`node ${cli} ${cmd} ${action} src/greeter.ts`
            assert(res.stdout.includes("interface_declaration"))
        })
        test("counting.py", async () => {
            const res =
                await $`node ${cli} ${cmd} ${action} src/counting.py "(class_definition) @i"`
            assert(res.stdout.includes("class_definition"))
        })
        test("ewd.tla", async () => {
            const res =
               await $`node ${cli} ${cmd} ${action} src/tla/EWD998PCal.tla "(block_comment) @i"`
            assert(res.stdout.includes("block_comment"))
        })
        test("README.md not supported", async () => {
            const res =
                await $`node ${cli} ${cmd} ${action} README.md`.nothrow()
            assert(res.exitCode)
        })
    })
})
