const pool = require("../../shared/rds");

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  try {
    const connection = await pool.getConnection();

    try {
      const [rooms] = await connection.execute(`
        SELECT 
         *
        FROM podcast_rooms Full JOIN podcast_room_amenities ON podcast_rooms.id = podcast_room_amenities.room_id
        LEFT JOIN amenities ON podcast_room_amenities.amenity_id = amenities.id
        LEFT JOIN services ON podcast_rooms.id = services.room_id
        LEFT JOIN podcast_room_time_slots ON podcast_rooms.id = podcast_room_time_slots.room_id
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
