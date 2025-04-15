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
      throw new Error(`Invalid input value(s): ${errorDetails}`);
    }

    const { name, description, price } = event.body;
    const id = uuidv4();

    const connection = await pool.getConnection();

    try {
      const insertQuery = `
        INSERT INTO services (id, name, description, price)
        VALUES (?, ?, ?, ?)
      `;

      await connection.execute(insertQuery, [
        id,
        name,
        description,
        price,
      ]);

      return {
        statusCode: 201,
        body: JSON.stringify({
          message: "Service created successfully",
          service: {
            id,
            name,
            description,
            price,
          },
        }),
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Service creation error:", error);
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
      description: Joi.string().allow("").optional(),
      price: Joi.number().precision(2).min(0).required(),
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
