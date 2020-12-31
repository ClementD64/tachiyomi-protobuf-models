const fs = require('fs');
const path = require('path');

/**
 * A parsed definition entry
 * @typedef {{
 *  rule: "repeated" | "required" | "optional",
 *  number: number,
 *  type: string,
 *  name: string,
 *  match: string
 * }} Entry
 */

/**
 * A parsed definition entry
 * @typedef {{
 *  name: string,
 *  entries: Entry[]
 * }} Definition
 */

class Parser {
  /**
   * The magic regex
   * 
   * The kotlin models are build with class properties like
   * - @ProtoNumber(2) var url: String
   * - @ProtoNumber(3) var title: String = ""
   * - @ProtoNumber(6) var description: String?
   * - @ProtoNumber(7) var genre: List<String>
   * 
   * This regex match 5 groups  
   * - number: the protobuf field number (inside ProtoNumber)  
   * - name: the field name ("url" in the first example)  
   * - list: the type if it's a list ("String" in the fourth example)  
   * - type: the type if not a list ("String" in the other example)  
   * - optional: if the field if optional (match " =" in second example and "?" in third example)  
   * 
   * some field are commented (used in 1.x, not in 0.x), so we must not match it (negative group with "//")
   * 
   * @type {RegExp}
   */
  static regex = /^\s*(?!\/\/\s*)@ProtoNumber\((?<number>\d+)\)\s+va[rl]\s+(?<name>\w+):\s+(?:(?:List<(?<list>\w+)>)|(?<type>\w+))(?<optional>\?|(:?\s+=))?/gm;

  /**
   * Parsed definition
   * @type {Definition[]}
   */
  defs = [];

  /**
   * List parsed type names
   * @type {string[]}
   */
  types = [];

  /**
   * The build schema
   * @type {string}
   */
  schema = '';

  /**
   * The models source directory
   * @type {string}
   */
  root = '';

  /**
   * If current models as an error
   * @type {Boolean}
   */
  hasError = false;

  /**
   * Print an error message and set the parser in error state
   * @param {string} message 
   */
  error(message) {
    this.hasError = true;
    console.error(message);
  }

  /**
   * Build the schema from source models
   * @param {string} root source models directory 
   */
  constructor(root) {
    this.root = root;
    for (const filename of fs.readdirSync(this.root)) {
      this.parseFile(filename);
    }
    this.schema = this.build();
  }

  /**
   * Parse the given filename
   * @param {string} filename 
   */
  parseFile(filename) {
    const name = filename.replace('.kt', '');
    this.types.push(name);
    
    /** @type {Entry[]} */
    const entries = [];
    const file = fs.readFileSync(path.join(this.root, filename)).toString();
  
    let entry
    while ((entry = Parser.regex.exec(file)) !== null) {
      entries.push({
        rule: entry.groups.list ? 'repeated' : entry.groups.optional ? 'optional' : 'required',
        number: Number(entry.groups.number),
        type: entry.groups.list ? entry.groups.list : entry.groups.type,
        name: entry.groups.name,
        match: entry[0],
      });
    }
  
    if (entries.length !== (file.match(/^\s*(?!\/\/\s*)@ProtoNumber/gm)?.length ?? 0)) {
      this.error(`Not all @ProtoNumber matched in ${name}\n  matched: ${entries.map(v => v.name).join(', ')}`);
    }
  
    if (entries.length) {
      this.defs.push({ name, entries });
    }
  }

  /**
   * Convert kotlin type to protobuf type
   * @param {string} type kotlin type
   * @returns {string} protobuf type
   */
  type(type) {
    switch (type) {
      case 'String': return 'string';
      case 'Int': return 'int32';
      case 'Long': return 'int64';
      case 'Boolean': return 'bool';
      case 'Float': return 'float';
    }
  
    if (!this.types.includes(type)) {
      this.error(`Unknow type ${type}`);
    }
    
    return type;
  }

  /**
   * Build schema from parsed definition
   * @returns {string} generated schema
   */
  build() {
    const lines = ['syntax = "proto2";', ''];
    for (const { name, entries } of this.defs) {
      lines.push(`message ${name} {`);

      for (const entry of entries) {
        lines.push(
          `  // ${entry.match.trim()}`,
          `  ${entry.rule} ${this.type(entry.type)} ${entry.name} = ${entry.number};`
        )
      }

      lines.push('}', '');
    }

    return lines.join('\n');
  }

  /**
   * Write schema to output file
   * @param {string} output 
   */
  write(output) {
    fs.writeFileSync(output, this.schema);
  }
}

if (process.argv.length < 3) {
  console.error(`Usage: generate-models.js <output file> [models source]`);
}

const p = new Parser(process.argv[3] ?? './tachiyomi/app/src/main/java/eu/kanade/tachiyomi/data/backup/full/models/');
if (p.hasError) {
  process.exit(1);
}
p.write(process.argv[2]);
