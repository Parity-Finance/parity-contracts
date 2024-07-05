const path = require("path");
const { generateIdl } = require("@metaplex-foundation/shank-js");

const idlDir = path.join(__dirname, "..", "idls");
const binaryInstallDir = path.join(__dirname, "..", ".crates");
const programDir = path.join(__dirname, "..", "programs");

generateIdl({
  generator: "anchor",
  programName: "sold_issuance",
  programId: "E52KjA58odp3taqmaCuBFdDya3s4TA1ho4tSXoW2igxb",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "sold-issuance"),
  rustbin: { locked: true },
});

generateIdl({
  generator: "anchor",
  programName: "sold_staking",
  programId: "B6rAjGxw89UQCho4fLBGcEne9jadXv2QewPgpQ1SmUnw",
  idlDir,
  binaryInstallDir,
  programDir: path.join(programDir, "sold-staking"),
  rustbin: { locked: true },
});
