const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
  generator: "anchor",
  programName: "sold_issuance",
  programId: "77xdxhr4M3Y4tizBUp3yNpw9NfqpfxDaHxVdS4DqrDf2",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "sold-issuance"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "sold_staking",
  programId: "8mtouzv4S2HHmjNsPtctuKcseioXmTgAdigdaX7AqfLt",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "sold-staking"),
  rustbin: { locked: true },
});
