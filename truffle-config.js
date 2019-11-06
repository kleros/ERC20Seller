module.exports = {
  networks: {
    test: {
      gas: 100000000,
      host: 'localhost',
      network_id: '*',
      port: 8545
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 1
    }
  }
}
