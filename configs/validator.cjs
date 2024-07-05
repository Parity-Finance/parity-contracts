const path = require("path");

const programDir = path.join(__dirname, "..", "programs");

function getProgram(programBinary) {
  return path.join(programDir, ".bin", programBinary);
}

module.exports = {
  validator: {
    commitment: "processed",
    programs: [
      {
        label: "Sold Issuance",
        programId: "E52KjA58odp3taqmaCuBFdDya3s4TA1ho4tSXoW2igxb",
        deployPath: getProgram("sold_issuance.so"),
      },
      {
        label: "Sold Staking",
        programId: "B6rAjGxw89UQCho4fLBGcEne9jadXv2QewPgpQ1SmUnw",
        deployPath: getProgram("sold_staking.so"),
      },
      // Below are external programs that should be included in the local validator.
      // You may configure which ones to fetch from the cluster when building
      // programs within the `configs/program-scripts/dump.sh` script.
      {
        label: "Token Metadata",
        programId: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
        deployPath: getProgram("mpl_token_metadata.so"),
      },
      // {
      //   label: "SPL Noop",
      //   programId: "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV",
      //   deployPath: getProgram("spl_noop.so"),
      // },
      // {
      //   label: "Spl ATA Program",
      //   programId: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      //   deployPath: getProgram("spl_ata.so"),
      // },
      // {
      //   label: "SPL Token Program",
      //   programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      //   deployPath: getProgram("spl_token.so"),
      // },
      {
        label: "Mpl System Extras",
        programId: "SysExL2WDyJi9aRZrXorrjHJut3JwHQ7R9bTyctbNNG",
        deployPath: getProgram("mpl_system_extras.so"),
      },
    ],
  },
};
