const pool = require("../shared/rds");

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));
  const {capacity,price }=event.queryStringParameters 

  try {
    const [rows] = await pool.query("SELECT capacity from podcast_rooms");
    return {
        statusCode: 200,
        body: JSON.stringify({
          podcastRooms: rows,
        }),
      };
  } catch (error) {
    console.error("Error fetching podcast rooms:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to fetch podcast rooms",
        error: error.message,
      }),
    };
  }
};
