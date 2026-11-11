// Run both node:test suites in-process, including Windows restricted shells.
require("./loyalty.test.cjs");
require("./auth.test.cjs");
require("./customer-identity.test.cjs");
