import packageJson from "../package.json"

export const NODE_MIN_VERSION = packageJson.engines.node
export const LLAMAINDEX_VERSION = packageJson.optionalDependencies.llamaindex
