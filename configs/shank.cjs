const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
  generator: "anchor",
  programName: "parity_issuance",
  programId: "ALukFrRp8cFkWCEZamFVsBiFtxKYPLUUGRxskFh1g5ZX",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "parity-issuance"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "parity_staking",
  programId: "BZzrzzNm14rcF8edGVYY2NHyj9aQURFXubgEdRJoyzvH",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "parity-staking"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "pt_staking",
  programId: "AdXJ8Sr46ujd9DSLP5LRyF1BrqxT9azqmQqN2oTyV8cz",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "pt-staking"),
  rustbin: { locked: true },
});
