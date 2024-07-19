const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
  generator: "anchor",
  programName: "sold_issuance",
  programId: "4nRcwXvRUmpQMfjza6tsYyp3h6UA9hpT47yuXUwdmizo",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "sold-issuance"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "sold_staking",
  programId: "6GUDMDrbzne1qxpFF5WzeehZpC3gfAAoJ7GcHu7VNqjy",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "sold-staking"),
  rustbin: { locked: true },
});
