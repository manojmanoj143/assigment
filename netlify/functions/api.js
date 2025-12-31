try {
    const { handler } = require("../../server/index");
    exports.handler = handler;
} catch (error) {
    console.error("Function Initialization Error:", error);
    exports.handler = async () => {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Function Initialization Error", details: error.message, stack: error.stack }),
        };
    };
}
