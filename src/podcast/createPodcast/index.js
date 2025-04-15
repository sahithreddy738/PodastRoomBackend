const pool = require("../../shared/rds");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event));

  try {
    if (typeof event.body === 'string') {
      event.body = JSON.parse(event.body);
    }

    const validationResult = await validateEvent(event);
    if (validationResult !== true) {
      const errorDetails = validationResult
        .map((err) => `${err.path.join(".")} - ${err.message}`)
        .join(", ");
      throw new Error(`Invalid input value(s): ${errorDetails}`);
    }

    const {
      name,
      location,
      capacity,
      description,
      created_by,
      image_key,
    } = event.body;

    const id = uuidv4();

    const connection = await pool.getConnection();

    try {
      const [userCheck] = await connection.execute(
        `SELECT COUNT(*) AS count FROM users WHERE id = ?`,
        [created_by]
      );

      if (userCheck[0].count === 0) {
        throw new Error("Creator (user) with the given ID does not exist.");
      }

      const insertQuery = `
        INSERT INTO podcast_rooms (
          id, name, location, capacity, description,
          created_by, image_key
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await connection.execute(insertQuery, [
        id,
        name,
        location,
        capacity,
        description,
        created_by,
        image_key,
      ]);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Podcast room created successfully",
          roomId: id,
        }),
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Podcast room creation error:", error);
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
      name: Joi.string().min(2).max(255).required(),
      location: Joi.string().max(255).required(),
      capacity: Joi.number().integer().min(1).required(),
      description: Joi.string().allow("").optional(),
      created_by: Joi.string().uuid().required(),
      image_key: Joi.string().max(512).allow(null, '').optional(),
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
