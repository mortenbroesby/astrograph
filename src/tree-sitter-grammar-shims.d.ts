declare module "@astrograph/tree-sitter" {
  import Parser = require("tree-sitter");
  export = Parser;
}

declare module "tree-sitter-c-sharp" {
  const language: import("@astrograph/tree-sitter").Language;
  export default language;
}

declare module "tree-sitter-powershell" {
  const language: import("@astrograph/tree-sitter").Language;
  export default language;
}

declare module "tree-sitter-css" {
  const language: import("@astrograph/tree-sitter").Language;
  export default language;
}
