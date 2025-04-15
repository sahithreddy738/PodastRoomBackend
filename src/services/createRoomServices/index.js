const pool = require("../../shared/rds");
const Joi = require("joi");

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  try {
    if (typeof event.body === "string") {
      event.body = JSON.parse(event.body);
    }

    const validationResult = await validateEvent(event);
    if (validationResult !== true) {
      const errorDetails = validationResult
        .map((err) => `${err.path.join(".")} - ${err.message}`)
        .join(", ");
      throw new Error(`Invalid input value(s): ${errorDetails}`);
    }

    const { room_id, service_ids, user_id } = event.body;

    const connection = await pool.getConnection();

    try {
      const [roomRows] = await connection.execute(
        `SELECT created_by FROM podcast_rooms WHERE id = ?`,
        [room_id]
      );

      if (roomRows.length === 0) {
        throw new Error("Podcast room not found.");
      }

      const creatorId = roomRows[0].created_by;
      if (creatorId !== user_id) {
        throw new Error(
          "Unauthorized: You are not the creator of this podcast room."
        );
      }

      const [validServices] = await connection.query(
        `SELECT id FROM services WHERE id IN (${service_ids
          .map(() => "?")
          .join(",")})`,
        service_ids
      );

      const validIds = validServices.map((row) => row.id);
      const invalidIds = service_ids.filter((id) => !validIds.includes(id));

      if (invalidIds.length > 0) {
        throw new Error(`Invalid service IDs: ${invalidIds.join(", ")}`);
      }

      const insertPromises = service_ids.map((service_id) =>
        connection.execute(
          `INSERT IGNORE INTO room_services (room_id, service_id) VALUES (?, ?)`,
          [room_id, service_id]
        )
      );

      await Promise.all(insertPromises);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Services assigned to room successfully",
          room_id,
          assigned_services: service_ids,
        }),
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Room-services assignment error:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: error.message,
      }),
    };
  }
};

async function validateEvent(event) {
  const schema = Joi.object({
    body: Joi.object({
      room_id: Joi.string().uuid().required(),
      service_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
      user_id: Joi.string().uuid().required(),
    }).required(),
  })
    .required()
    .options({ allowUnknown: true });

  try {
    await schema.validateAsync(event);
    return true;
  } catch (e) {
    console.error("Validation Error:", e.details);
    return e.details;
  }
}
