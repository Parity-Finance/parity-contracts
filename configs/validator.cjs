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
        programId: "6JfYz5itjCP6jjaxqX8KQizXYcRtzmSsHJdbiLBeqvEH",
        deployPath: getProgram("sold_issuance.so"),
      },
      {
        label: "Sold Staking",
        programId: "BmyPBNiuBnKrjcHPmGDkgmiYNgQA2s6ygKNR38CXSaxW",
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
      // {
      //   label: "Pyth Receiver",
      //   programId: "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
      //   deployPath: getProgram("pyth_receiver.so"),
      // },
      // {
      //   label: "Push Oracle",
      //   programId: "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT",
      //   deployPath: getProgram("pyth_push_oracle.so"),
      // }
    ],
    accounts: [
      {
        label: "USDC Price Update Account",
        accountId: "Dpw1EAVrSB1ibxiDQyTAW6Zip3J4Btk2x4SgApQCeFbX",
        cluster: 'mainnet-beta'
      }
    ]
  },
};
