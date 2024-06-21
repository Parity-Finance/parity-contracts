const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
  generator: "anchor",
  programName: "sold_issuance",
  programId: "JCLA8ET4DCCsJsvNcaNBhpY8ZudFfAbpgspPBnni1NQy",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "sold-issuance"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "sold_staking",
  programId: "EuhcfekB1smmCcNqr38FvXtmWGkDy3rx8u9L1hf7ee3E",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "sold-staking"),
  rustbin: { locked: true },
});
