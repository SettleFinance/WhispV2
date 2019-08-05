const Multisend = artifacts.require("Multisend");

module.exports = function(deployer) {
  deployer.deploy(Multisend, 5);
};
