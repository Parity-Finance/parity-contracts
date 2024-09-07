const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
  generator: "anchor",
  programName: "parity_issuance",
  programId: "7hkMsfmcxQmJERtzpGTGUn9jmREBZkxYRF2rZ9BRWkZU",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "parity-issuance"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "parity_staking",
  programId: "AJmk6gK2zALnLxaXYR6CzTYMFRu62adT4dVUKpxNT5Zh",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "parity-staking"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "pt_staking",
  programId: "6cxnuwSaJgaBsq6szLNGQ3UMibUB7XNv1mpoC91t37yv",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "pt-staking"),
  rustbin: { locked: true },
});
