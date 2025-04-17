const pool = require("../../shared/rds");

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  try {
    const { location, capacity, priceRange } = event.queryStringParameters || {};
    const connection = await pool.getConnection();

    try {
      let query = `
        SELECT 
          pr.*, 
          a.name AS amenity_name, 
          s.name AS service_name, 
          s.description AS service_description, 
          s.price AS service_price,
          ts.start_time, 
          ts.end_time
        FROM podcast_rooms pr
        LEFT JOIN podcast_room_amenities pra ON pr.id = pra.room_id
        LEFT JOIN amenities a ON pra.amenity_id = a.id
        LEFT JOIN room_services rs ON pr.id = rs.room_id
        LEFT JOIN services s ON rs.service_id = s.id
        LEFT JOIN time_slots ts ON pr.id = ts.room_id
        WHERE 1=1
      `;

      const values = [];

      if (location) {
        query += " AND pr.location = ?";
        values.push(location.trim());
      }
      if (capacity) {
        query += " AND pr.capacity >= ?";
        values.push(Number(capacity));
      }
      if (priceRange) {
        const [min, max] = priceRange.split("-").map(Number);
        query += " AND pr.price BETWEEN ? AND ?";
        values.push(min, max);
      }

      query += " ORDER BY pr.created_at DESC";

      const [rooms] = await connection.execute(query, values);

      return {
        statusCode: 200,
        body: JSON.stringify({ podcastRooms: rooms }),
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
