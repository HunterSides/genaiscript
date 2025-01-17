import {
    FragmentTransformResponse,
    YAMLStringify,
    diagnosticsToCSV,
    host,
    isJSONLFilename,
    logVerbose,
    readText,
    runTemplate,
    writeText,
    normalizeInt,
    normalizeFloat,
    GENAI_JS_REGEX,
    GPSPEC_REGEX,
    FILES_NOT_FOUND_ERROR_CODE,
    appendJSONL,
    RUNTIME_ERROR_CODE,
    ANNOTATION_ERROR_CODE,
    writeFileEdits,
    parseVars,
} from "genaiscript-core"
import getStdin from "get-stdin"
import { basename, resolve, join } from "node:path"
import { isQuiet } from "./log"
import { emptyDir, ensureDir } from "fs-extra"
import { convertDiagnosticsToSARIF } from "./sarif"
import { buildProject } from "./build"
import { createProgressSpinner } from "./spinner"

export async function runScript(
    tool: string,
    specs: string[],
    options: {
        excludedFiles: string[]
        out: string
        retry: string
        retryDelay: string
        maxDelay: string
        json: boolean
        yaml: boolean
        prompt: boolean
        outTrace: string
        outAnnotations: string
        outChangelogs: string
        outData: string
        label: string
        temperature: string
        topP: string
        seed: string
        maxTokens: string
        model: string
        csvSeparator: string
        cache: boolean
        applyEdits: boolean
        failOnErrors: boolean
        removeOut: boolean
        vars: string[]
    }
) {
    const excludedFiles = options.excludedFiles
    const stream = !options.json && !options.yaml && !options.out
    const out = options.out
    const skipLLM = !!options.prompt
    const retry = parseInt(options.retry) || 8
    const retryDelay = parseInt(options.retryDelay) || 15000
    const maxDelay = parseInt(options.maxDelay) || 180000
    const outTrace = options.outTrace
    const outAnnotations = options.outAnnotations
    const failOnErrors = options.failOnErrors
    const outChangelogs = options.outChangelogs
    const outData = options.outData
    const label = options.label
    const temperature = normalizeFloat(options.temperature)
    const topP = normalizeFloat(options.topP)
    const seed = normalizeFloat(options.seed)
    const maxTokens = normalizeInt(options.maxTokens)
    const cache = !!options.cache
    const applyEdits = !!options.applyEdits
    const model = options.model
    const csvSeparator = options.csvSeparator || "\t"
    const removeOut = options.removeOut
    const vars = options.vars

    const spinner =
        !stream && !isQuiet
            ? createProgressSpinner("preparing tool and files")
            : undefined

    let spec: string
    let specContent: string
    const toolFiles: string[] = []

    let md: string
    const files = new Set<string>()

    if (GENAI_JS_REGEX.test(tool)) toolFiles.push(tool)

    if (!specs?.length) {
        specContent = (await getStdin()) || "\n"
        spec = "stdin.gpspec.md"
    } else if (specs.length === 1 && GPSPEC_REGEX.test(specs[0])) {
        spec = specs[0]
    } else {
        for (const arg of specs) {
            const ffs = await host.findFiles(arg)
            for (const file of ffs) {
                if (GPSPEC_REGEX.test(file)) {
                    md = (md || "") + (await readText(file)) + "\n"
                } else {
                    files.add(file)
                }
            }
        }
    }

    if (excludedFiles?.length) {
        for (const arg of excludedFiles) {
            const ffs = await host.findFiles(arg)
            for (const f of ffs) files.delete(f)
        }
    }

    if (md || files.size) {
        spec = "cli.gpspec.md"
        specContent = `${md || "# Specification"}

${Array.from(files)
    .map((f) => `-   [${basename(f)}](./${f})`)
    .join("\n")}
`
    }

    if (!spec) {
        spinner?.fail(`genai spec not found`)
        process.exit(FILES_NOT_FOUND_ERROR_CODE)
    }

    if (specContent !== undefined) host.setVirtualFile(spec, specContent)

    const prj = await buildProject({
        toolFiles,
        specFiles: [spec],
    })
    const script = prj.templates.find(
        (t) =>
            t.id === tool ||
            (t.filename &&
                GENAI_JS_REGEX.test(tool) &&
                resolve(t.filename) === resolve(tool))
    )
    if (!script) throw new Error(`tool ${tool} not found`)
    const gpspec = prj.rootFiles.find(
        (f) => resolve(f.filename) === resolve(spec)
    )
    if (!gpspec) throw new Error(`spec ${spec} not found`)
    const fragment = gpspec.fragments[0]
    if (!fragment) {
        spinner?.fail(`genai spec not found`)
        process.exit(FILES_NOT_FOUND_ERROR_CODE)
    }

    spinner?.start("Querying")

    let tokens = 0
    const res: FragmentTransformResponse = await runTemplate(script, fragment, {
        infoCb: ({ text }) => {
            spinner?.start(text)
        },
        partialCb: ({ responseChunk, tokensSoFar }) => {
            tokens = tokensSoFar
            if (stream) process.stdout.write(responseChunk)
            else if (spinner) spinner.report({ count: tokens })
        },
        skipLLM,
        label,
        cache,
        temperature,
        topP,
        seed,
        maxTokens,
        model,
        retry,
        retryDelay,
        maxDelay,
        vars: parseVars(vars),
    })

    if (spinner) {
        if (res.error) spinner.fail(`${spinner.text}, ${res.error}`)
        else spinner.succeed()
    }

    if (outTrace && res.trace) await writeText(outTrace, res.trace)
    if (outAnnotations && res.annotations?.length) {
        if (isJSONLFilename(outAnnotations))
            await appendJSONL(outAnnotations, res.annotations)
        else
            await writeText(
                outAnnotations,
                /\.(c|t)sv$/i.test(outAnnotations)
                    ? diagnosticsToCSV(res.annotations, csvSeparator)
                    : /\.ya?ml$/i.test(outAnnotations)
                      ? YAMLStringify(res.annotations)
                      : /\.sarif$/i.test(outAnnotations)
                        ? convertDiagnosticsToSARIF(script, res.annotations)
                        : JSON.stringify(res.annotations, null, 2)
            )
    }
    if (outChangelogs && res.changelogs?.length)
        await writeText(outChangelogs, res.changelogs.join("\n"))
    if (outData && res.frames?.length)
        if (isJSONLFilename(outData)) await appendJSONL(outData, res.frames)
        else await writeText(outData, JSON.stringify(res.frames, null, 2))

    if (applyEdits && !res.error && Object.keys(res.fileEdits || {}).length)
        await writeFileEdits(res)

    const promptjson = res.prompt?.length
        ? JSON.stringify(res.prompt, null, 2)
        : undefined
    if (out) {
        if (removeOut) await emptyDir(out)
        await ensureDir(out)

        const jsonf = /\.json$/i.test(out) ? out : join(out, `res.json`)
        const yamlf = /\.ya?ml$/i.test(out) ? out : join(out, `res.yaml`)
        const mkfn = (ext: string) => jsonf.replace(/\.json$/i, ext)
        const promptf = mkfn(".prompt.json")
        const outputf = mkfn(".output.md")
        const tracef = mkfn(".trace.md")
        const annotationf = res.annotations?.length
            ? mkfn(".annotations.csv")
            : undefined
        const sariff = res.annotations?.length ? mkfn(".sarif") : undefined
        const specf = specContent ? mkfn(".gpspec.md") : undefined
        const changelogf = res.changelogs?.length
            ? mkfn(".changelog.txt")
            : undefined
        await writeText(jsonf, JSON.stringify(res, null, 2))
        await writeText(yamlf, YAMLStringify(res))
        if (promptjson) {
            await writeText(promptf, promptjson)
        }
        if (res.text) await writeText(outputf, res.text)
        if (res.trace) await writeText(tracef, res.trace)
        if (specf) {
            const spect = await readText(spec)
            await writeText(specf, spect)
        }
        if (annotationf) {
            await writeText(
                annotationf,
                `severity, filename, start, end, message\n` +
                    res.annotations
                        .map(
                            ({ severity, filename, range, message }) =>
                                `${severity}, ${filename}, ${range[0][0]}, ${range[1][0]}, ${message} `
                        )
                        .join("\n")
            )
        }
        if (sariff)
            await writeText(
                sariff,
                convertDiagnosticsToSARIF(script, res.annotations)
            )
        if (changelogf && res.changelogs?.length)
            await writeText(changelogf, res.changelogs.join("\n"))
    } else {
        if (options.json) console.log(JSON.stringify(res, null, 2))
        if (options.yaml) console.log(YAMLStringify(res))
        if (options.prompt && promptjson) {
            console.log(promptjson)
        }
    }

    // final fail
    if (res.error) {
        logVerbose(`error: ${(res.error as Error).message || res.error}`)
        process.exit(RUNTIME_ERROR_CODE)
    }

    if (failOnErrors && res.annotations?.some((a) => a.severity === "error")) {
        console.log`error annotations found, exiting with error code`
        process.exit(ANNOTATION_ERROR_CODE)
    }
    logVerbose(`genaiscript generated ${tokens} tokens`)
}
