const pool = require("../../shared/rds");
const Joi = require("joi");

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  try {
    const room_id = event.queryStringParameters?.room_id;

    // Validate room_id
    const { error } = Joi.string().uuid().required().validate(room_id);
    if (error) {
      throw new Error(`Invalid room_id: ${error.message}`);
    }

    const connection = await pool.getConnection();

    try {
      // Check if room exists
      const [roomExists] = await connection.execute(
        `SELECT id FROM podcast_rooms WHERE id = ?`,
        [room_id]
      );
      if (roomExists.length === 0) {
        throw new Error("Podcast room not found.");
      }

      // Get assigned services
      const [assignedServices] = await connection.execute(
        `
          SELECT s.id, s.name, s.description,s.price
          FROM room_services rs
          JOIN services s ON rs.service_id = s.id
          WHERE rs.room_id = ?
        `,
        [room_id]
      );

      return {
        statusCode: 200,
        body: JSON.stringify({
          room_id,
          services: assignedServices,
        }),
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Get room services error:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: error.message,
      }),
    };
  }
};
