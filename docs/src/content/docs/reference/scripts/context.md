---
title: Context (env+def)
sidebar:
    order: 3
description: Detailed documentation on the script execution context and environment variables in GenAIScript.
keywords: script execution, env object, GenAIScript context, def function, env files
---

The information about the context of the script execution are available in the `env` global object.

## Environment (`env`)

The `env` global object contains properties that provide information about the script execution context.
`env` is populated automatically by the GenAIScript runtime.

### `env.files`

The `env.files` array contains all files within the execution context. The context is defined implicitly
by the user based on the UI location to start the tool or from the CLI arguments.

```js
def("FILE", env.files)
```

Or filtered,

```js
def("DOCS", env.files, { endsWith: ".md" })
def("CODE", env.files, { endsWith: ".py" })
```

### `env.vars`

The `vars` property contains the variables that have been defined in the script execution context.

```javascript
// grab locale from variable or default to en-US
const locale = env.vars.locale || "en-US"
```

Read more about [variables](/genaiscript/reference/scripts/variables).

### `env.secrets`

The `secrets` property contains the secrets that have been defined in the script execution context.

```javascript
const token = env.secrets.SECRET_TOKEN
```

Read more about [secrets](/genaiscript/reference/scripts/secrets).

### `env.spec`

The `env.spec` property contains the information about the [spec](/genaiscript/reference/scripts/spec) being executed.
In most cases, the spec has been generated automatically based on the UI context.

```js
// get the directory where the UI was invoked
const dir = path.dirname(env.spec.filename)
```

## Definition (`def`)

The `def("FILE", file)` function is a shorthand for generating a fenced variable output.
The "meta-variable" (`FILE` in this example) name should be all uppercase (but can include

```js "def"
def("FILE", file)
```

approximately equivalent to:

````js
$`FILE ${file.filename}:
```
${env.file.content}
```
````

The `def` function can also be used with an array of files, such as `env.files`.

```js "env.files"
def("FILE", env.files)
```

### Referencing

The `def` function returns a variable name that can be used in the prompt.
The name might be formatted diferently to accomodate the model's preference.

```js "const f = "
const f = def("FILE", file)

$`Summarize ${f}.`
```

### File filters

Since a script may be executed on a full folder, it is often useful to filter the files based on 

- their extension
```js "endsWith: '.md'"
def("FILE", env.files, { endsWith: '.md' })
```

- or using a [glob](https://en.wikipedia.org/wiki/Glob_(programming)):
```js "glob: '**/*.{md,mdx}'"
def("FILE", files, { glob: '**/*.{md,mdx}' })
```

### Empty files

By default, if `def` is used with an empty array of files, it will cancel the prompt. You can override this behavior
by setting `ignoreEmpty` to `true`.

```js "ignoreEmpty: true"
def("FILE", env.files, { endsWith: ".md", ignoreEmpty: true })
```

## Data definition (`defData`)

The `defData` function offers additional formatting options for converting a data object into a textual representation. It supports rendering objects as YAML, JSON, or CSV (formatted as a markdown table).

```js
// render to YAML by default
defData("DATA", data)

// render as CSV by default
defData("DATA", csv, { format: "csv" })
```

## Fencing

When expanding user markdown into your prompt, it is crucial to properly fence the user code to prevent accidental prompt injection and confusion.

The `env.fence` variable is set to a suitable fencing delimiter that will not interfere with the user content delimiters.

```js
$`
${env.fence}
...
${env.fence}
`
```
