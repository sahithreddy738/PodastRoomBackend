const pool = require("../../shared/rds");
const { v4: uuidv4 } = require("uuid");
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
      throw new Error(`Invalid input: ${errorDetails}`);
    }

    const { userId, roomId, startTime, endTime } = event.body;

    if (startTime >= endTime) {
      throw new Error("Start time must be earlier than end time.");
    }

    const connection = await pool.getConnection();

    try {
      const [roomRows] = await connection.execute(
        `SELECT created_by FROM podcast_rooms WHERE id = ?`,
        [roomId]
      );

      if (roomRows.length === 0) {
        throw new Error("Room not found.");
      }

      if (roomRows[0].created_by !== userId) {
        throw new Error(
          "You are not authorized to create slots for this room."
        );
      }
      const overlapCheckQuery = `
      SELECT COUNT(*) AS overlap_count
      FROM time_slots
      WHERE room_id = ?
      AND start_time < ?
      AND end_time > ?
    `;

      const [overlapResult] = await connection.execute(overlapCheckQuery, [
        roomId,
        endTime,
        startTime,
      ]);

      if (overlapResult[0].overlap_count > 0) {
        throw new Error(
          "Time slot overlaps with an existing slot in the same room."
        );
      }

      const slotId = uuidv4();
      const insertQuery = `
        INSERT INTO time_slots (id, room_id, start_time, end_time) 
        VALUES (?, ?, ?, ?)
      `;
      await connection.execute(insertQuery, [
        slotId,
        roomId,
        startTime,
        endTime,
      ]);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Time slot created successfully",
          slotId,
          startTime,
          endTime,
        }),
      };
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Slot creation error:", err);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: err.message }),
    };
  }
};

async function validateEvent(event) {
  const schema = Joi.object({
    body: Joi.object({
      userId: Joi.string().required(),
      roomId: Joi.string().required(),
      startTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .required(),
      endTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .required(),
    }).required(),
  }).options({ allowUnknown: true });

  try {
    await schema.validateAsync(event);
    return true;
  } catch (e) {
    return e.details;
  }
}
