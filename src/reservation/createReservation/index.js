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

    const { userId, slotId, date, serviceIds } = event.body;

    const connection = await pool.getConnection();
    try {
      // Check if slot is already booked for this date
      const [existing] = await connection.execute(
        `SELECT COUNT(*) AS count FROM reservations 
         WHERE slot_id = ? AND date = ? AND status != 'cancelled'`,
        [slotId, date]
      );

      if (existing[0].count > 0) {
        throw new Error("Slot already reserved for the selected date.");
      }

      const reservationId = uuidv4();

      // Insert reservation
      await connection.execute(
        `INSERT INTO reservations (id, user_id, slot_id, date, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [reservationId, userId, slotId, date]
      );

      // If services are selected
      if (serviceIds && serviceIds.length > 0) {
        // Validate service IDs exist
        const [validServices] = await connection.query(
          `SELECT id FROM services WHERE id IN (${serviceIds.map(() => '?').join(',')})`,
          serviceIds
        );

        const validIds = validServices.map((row) => row.id);
        const invalidIds = serviceIds.filter((id) => !validIds.includes(id));
        if (invalidIds.length > 0) {
          throw new Error(`Invalid service IDs: ${invalidIds.join(", ")}`);
        }

        // Insert into reservation_services
        const insertPromises = serviceIds.map((service_id) =>
          connection.execute(
            `INSERT INTO reservation_services (reservation_id, service_id)
             VALUES (?, ?)`,
            [reservationId, service_id]
          )
        );

        await Promise.all(insertPromises);
      }

      return {
        statusCode: 201,
        body: JSON.stringify({
          message: "Slot reserved. Complete payment to confirm.",
          reservationId,
          servicesAttached: serviceIds || [],
        }),
      };
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error("Reservation error:", err);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: err.message }),
    };
  }
};

// 🛡 Joi validation with serviceIds
async function validateEvent(event) {
  const schema = Joi.object({
    body: Joi.object({
      userId: Joi.string().guid({ version: "uuidv4" }).required(),
      slotId: Joi.string().guid({ version: "uuidv4" }).required(),
      date: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .messages({
          "string.pattern.base": `"date" must be in YYYY-MM-DD format`,
        }),
      serviceIds: Joi.array()
        .items(Joi.string().guid({ version: "uuidv4" }))
        .optional(),
    }).required(),
  }).options({ allowUnknown: true });

  try {
    await schema.validateAsync(event);
    return true;
  } catch (e) {
    return e.details;
  }
}
