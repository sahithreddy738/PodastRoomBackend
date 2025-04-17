const pool = require("../../shared/rds");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");

exports.handler = async (event) => {
    const connection = await pool.getConnection();
    try {
      const {
        name,
        description,
        image_key,
        location,
        capacity,
        price,
        created_by,
        amenities,
        services,
        timeSlots
      } = JSON.parse(event.body);
  
      const roomId = uuidv4();
  
      await connection.beginTransaction();
  
      await connection.query(
        `INSERT INTO podcast_rooms (id, name, description, image_key, location, capacity, price, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [roomId, name, description, image_key, location, capacity, price, created_by]
      );
  
      for (const amenityName of amenities) {
        const amenityId = uuidv4();
        await connection.query(
          `INSERT IGNORE INTO amenities (id, name) VALUES (?, ?)`,
          [amenityId, amenityName]
        );
        const [rows] = await connection.query(
          `SELECT id FROM amenities WHERE name = ?`,
          [amenityName]
        );
        await connection.query(
          `INSERT INTO podcast_room_amenities (room_id, amenity_id) VALUES (?, ?)`,
          [roomId, rows[0].id]
        );
      }
  
      for (const service of services) {
        const { name, description, price } = service;
        const serviceId = uuidv4();
        await connection.query(
          `INSERT IGNORE INTO services (id, name, description, price) VALUES (?, ?, ?, ?)`,
          [serviceId, name, description, price]
        );
        const [rows] = await connection.query(
          `SELECT id FROM services WHERE name = ?`,
          [name]
        );
        await connection.query(
          `INSERT INTO room_services (room_id, service_id) VALUES (?, ?)`,
          [roomId, rows[0].id]
        );
      }
  
      for (const slot of timeSlots) {
        const timeslotId = uuidv4();
        await connection.query(
          `INSERT INTO time_slots (id, room_id, start_time, end_time)
           VALUES (?, ?, ?, ?)`,
          [timeslotId, roomId, slot.start_time, slot.end_time]
        );
      }
  
      await connection.commit();
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Podcast room created successfully",
        //   roomId: id,
        })}
    } catch (err) {
      await connection.rollback();
      console.error('Error creating podcast room:', err);
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: `Podcast room error${err}`,
        //   roomId: id,
        })}
    } finally {
      connection.release();
    }
}
