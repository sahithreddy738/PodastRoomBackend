const pool = require("../../shared/rds");

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  try {
    const connection = await pool.getConnection();

    try {
      const [rooms] = await connection.execute(`
        SELECT 
          id,
          name,
          location,
          capacity,
          description,
          image_key,
          created_at,
          created_by
        FROM podcast_rooms
        ORDER BY created_at DESC
      `);

      return {
        statusCode: 200,
        body: JSON.stringify({
          podcastRooms: rooms,
        }),
      };
    } finally {
      connection.release();
    }
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
