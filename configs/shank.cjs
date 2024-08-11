const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
  generator: "anchor",
  programName: "parity_issuance",
  programId: "2EWh1kTyMUgv46FdwJYJP61LXvrhLp5CqDfy5gDoqggf",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "parity-issuance"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "parity_staking",
  programId: "9fQsEayPeUdypEAjyE6HGBkPWqrkMnnJG8Sh5NBXwwAM",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "parity-staking"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "pt_staking",
  programId: "5zWkamSdh3S4hELhV1ezx6gzyCinBVi38StJUdi8cfGa",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "pt-staking"),
  rustbin: { locked: true },
});
