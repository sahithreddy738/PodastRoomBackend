const pool = require("../../shared/rds");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const bcrypt = require("bcrypt");

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

    const body = event.body;
    const { name, email, password } = body;
    const id = uuidv4();

    const hashedPassword = await bcrypt.hash(password, 10);

    const connection = await pool.getConnection();

    try {
      const [checkResult] = await connection.execute(
        `SELECT COUNT(*) AS count FROM users WHERE email = ?`,
        [email]
      );

      if (checkResult.count > 0) {
        throw new Error("User with the given email already exists.");
      }

      const insertQuery = `
        INSERT INTO users (id, name, email, password)
        VALUES (?, ?, ?, ?)
      `;
      await connection.execute(insertQuery, [id, name, email, hashedPassword]);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "User created successfully",
          userId: id,
        }),
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("User creation error:", error);
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
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
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
