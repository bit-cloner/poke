const createCluster = require("./eks.js")

createCluster("eks18")

createCluster("eks19-dev")

// wait for about 15 minutes untill master endpoint is created
// Then query existing cluster's clusterSecurityGroupId
// Then modify this SG to allow access from selected sources.
