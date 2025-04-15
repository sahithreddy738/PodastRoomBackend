const pool = require("../../shared/rds");

exports.handler = async (event) => {
  console.log("Incoming event:", JSON.stringify(event));
  try {
    if (typeof event.queryStringParameters === "string") {
      event.queryStringParameters = JSON.parse(event.queryStringParameters);
    }

    const { roomId, date } = event.queryStringParameters || {};

    if (!roomId || !date) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "roomId and date are required." }),
      };
    }

    const connection = await pool.getConnection();

    try {
      const [allSlots] = await connection.execute(
        `SELECT id, start_time, end_time 
         FROM time_slots 
         WHERE room_id = ?`,
        [roomId]
      );

      const [reservedSlots] = await connection.execute(
        `SELECT r.slot_id
         FROM reservations r
         JOIN time_slots t ON r.slot_id = t.id
         WHERE t.room_id = ? AND r.date = ? AND r.status != 'cancelled'`,
        [roomId, date]
      );
      

      const reservedSlotIds = reservedSlots.map((r) => r.slot_id);

      const resultSlots = allSlots.map((slot) => ({
        id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        status: reservedSlotIds.includes(slot.id) ? "unavailable" : "available",
      }));

      return {
        statusCode: 200,
        body: JSON.stringify({ slots: resultSlots }),
      };
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Error fetching slots with status:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message }),
    };
  }
};
