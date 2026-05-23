const { app } = require('./routes');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Fund DCA Backtester running on port ${PORT}`));