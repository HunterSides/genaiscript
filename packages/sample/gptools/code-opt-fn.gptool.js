gptool({
    title: "Code Patches",
    description:
        "Optimize code to run faster, modified from https://twitter.com/mattshumer_/status/1719403205950349588.",
    maxTokens: 2000,
    categories: ["samples"],
    system: [],
})

defFunction("patch_file", "Describes a patch to a file.", {
    "type": "object",
    "properties": {
        "lineStart": {
            "type": "string",
            "description": "The line number to start the patch.",
        },
        "lineEnd": {
            "type": "string",
            "description": "The line number to end the patch.",
        },
        "content": {
            "type": "string",
            "description": "The content to replace the patch with. If not provided, the patch will be deleted.",
        }
    },
    "required": ["lineStart", "lineEnd"],
}, (args) => {
    const { lineStart, lineEnd, content } = args
    return `[${lineStart}-${lineEnd}] ${content || ""}`
})

// Modified from https://twitter.com/mattshumer_/status/1719403205950349588?s=46
def("FILE", env.links, { lineNumbers: true })

$`
You are a world expert in making code run faster. You use any resource you can to do so.

Given some code in FILE files, identify how long it might take to run.

After that, identify which parts are key candidates to speed up.

After that, order the candidates by ranking.

Take the top-ranked candidate and explain in more detail how 
to rewrite the code to be faster using a patch.
Then, rewrite the actual code. 
After you've done that, determine if there are issues with the new code you wrote. 
If so, move on. Otherwise, rewrite the code again to fix them.

Call function patch_file for each speed improvements.
`