const pool = require("../../shared/rds");

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  try {
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.execute(`
        SELECT 
          pr.id AS room_id,
          pr.name AS room_name,
          pr.location,
          pr.capacity,
          pr.description,
          pr.created_by,
          pr.created_at,
          pr.image_key,
          pr.price,
          a.id AS amenity_id,
          a.name AS amenity_name
        FROM podcast_rooms pr
        LEFT JOIN podcast_room_amenities pra ON pr.id = pra.room_id
        LEFT JOIN amenities a ON pra.amenity_id = a.id
        ORDER BY pr.created_at DESC
      `);

      const podcastRoomsMap = new Map();

      for (const row of rows) {
        if (!podcastRoomsMap.has(row.room_id)) {
          podcastRoomsMap.set(row.room_id, {
            id: row.room_id,
            name: row.room_name,
            location: row.location,
            capacity: row.capacity,
            description: row.description,
            created_by: row.created_by,
            created_at: row.created_at,
            image_key: row.image_key,
            price: row.price,
            amenities: [],
          });
        }

        if (row.amenity_id && row.amenity_name) {
          podcastRoomsMap.get(row.room_id).amenities.push({
            id: row.amenity_id,
            name: row.amenity_name,
          });
        }
      }

      const podcastRooms = Array.from(podcastRoomsMap.values());

      return {
        statusCode: 200,
        body: JSON.stringify({ podcastRooms }),
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
