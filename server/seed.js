import { openDatabase } from './db.js';
import { hashPassword, today, transaction } from './domain.js';
export function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export async function seedDemo(db) {
  if (db.prepare('SELECT id FROM users LIMIT 1').get()) return;
  const password = await hashPassword('SivaDemo2026!');
  transaction(db, () => {
    const user = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)');
    user.run('Arjun Kumar', 'customer@siva.test', password, 'customer');
    user.run('Siva Motors', 'owner@siva.test', password, 'owner');
    user.run('Meera Nair', 'meera@siva.test', password, 'owner');
    const vehicles = [
      [
        'Maruti Suzuki Swift',
        'A nimble city companion with room for your weekend plans.',
        'Easy to drive and easy to park. This well-maintained hatchback is ideal for city errands and short getaways. Pick up with a full tank and return with the same fuel level.',
        'Car',
        'TN09AB1201',
        180000,
        'Chennai',
        ['Manual transmission', 'Air conditioning', '5 seats', 'Bluetooth'],
        '/images/swift.jpg',
        2,
      ],
      [
        'Hyundai Creta',
        'Space for the family. Comfort for the long way home.',
        'A comfortable SUV for family trips and highway driving. Includes air conditioning, navigation and ample luggage space. A valid driving licence is required at pickup.',
        'SUV',
        'TN10CD2202',
        320000,
        'Chennai',
        ['Automatic transmission', 'Air conditioning', 'GPS', '5 seats', 'Bluetooth'],
        '/images/creta.jpg',
        2,
      ],
      [
        'Royal Enfield Classic 350',
        'Take the scenic route on a classic motorcycle.',
        'A relaxed motorcycle for open roads and coastal rides. Two helmets are included. Please wear protective riding gear and bring a valid motorcycle licence.',
        'Bike',
        'TN22EF3303',
        90000,
        'Chennai',
        ['Manual transmission', '2 seats', 'Helmet included'],
        '/images/bike.jpg',
        3,
      ],
      [
        'Toyota Innova Crysta',
        'Bring everyone along, with space left for the bags.',
        'A spacious people carrier for group travel. Seven seats, rear air conditioning and generous luggage space make longer journeys comfortable. Self-drive rental.',
        'Van',
        'KA01GH4404',
        380000,
        'Bengaluru',
        ['Manual transmission', 'Air conditioning', '7 seats', 'Bluetooth'],
        '/images/van.jpg',
        3,
      ],
      [
        'Honda City',
        'A smooth, comfortable drive for everyday escapes.',
        'A refined sedan with an automatic gearbox and a comfortable cabin. Suitable for business travel and longer drives. Pickup instructions are shared after owner approval.',
        'Car',
        'KA03IJ5505',
        240000,
        'Bengaluru',
        ['Automatic transmission', 'Air conditioning', '5 seats', 'GPS'],
        '/images/city.jpg',
        2,
      ],
      [
        'Mahindra Thar',
        'Built for the journey beyond your usual roads.',
        'A capable four-seat SUV for road trips. Please stay on permitted public roads; off-road use is not covered by this demo rental agreement. A valid driving licence is required.',
        'SUV',
        'TN07KL6606',
        450000,
        'Coimbatore',
        ['Manual transmission', 'Air conditioning', '4 seats', 'Bluetooth'],
        '/images/thar.jpg',
        3,
      ],
    ];
    const insert = db.prepare(
      'INSERT INTO vehicles (name,summary,description,type,registration,daily_price,location,features,images,owner_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
    );
    for (const [
      name,
      summary,
      desc,
      type,
      reg,
      price,
      location,
      features,
      image,
      owner,
    ] of vehicles)
      insert.run(
        name,
        summary,
        desc,
        type,
        reg,
        price,
        location,
        JSON.stringify(features),
        JSON.stringify([image]),
        owner,
      );
    db.prepare('INSERT INTO coupons VALUES (?,?,?,?,?,?,1)').run(
      'FIRST10',
      'percent',
      10,
      100000,
      '2020-01-01',
      '2100-12-31',
    );
    db.prepare('INSERT INTO coupons VALUES (?,?,?,?,?,?,1)').run(
      'ROAD500',
      'fixed',
      50000,
      500000,
      '2020-01-01',
      '2100-12-31',
    );
    const snapshot = JSON.stringify({
      vehicle: 'Maruti Suzuki Swift',
      registration: 'TN09AB1201',
      location: 'Chennai',
      owner: 'Siva Motors',
      customer: 'Arjun Kumar',
      customer_email: 'customer@siva.test',
    });
    const past = db.prepare(
      "INSERT INTO bookings (vehicle_id,customer_id,start_date,end_date,status,daily_price,days,subtotal,total,snapshot) VALUES (1,1,?,?,'returned',180000,2,360000,360000,?)",
    );
    past.run(addDays(today(), -8), addDays(today(), -6), snapshot);
    db.prepare(
      'INSERT INTO reviews (booking_id,vehicle_id,customer_id,rating,body) VALUES (1,1,1,5,?)',
    ).run(
      'Demo review: a clean vehicle, clear pickup instructions and a comfortable weekend drive.',
    );
    const future = db.prepare(
      "INSERT INTO bookings (vehicle_id,customer_id,start_date,end_date,status,daily_price,days,subtotal,total,snapshot) VALUES (2,1,?,?,'approved',320000,3,960000,960000,?)",
    );
    future.run(
      addDays(today(), 7),
      addDays(today(), 10),
      JSON.stringify({
        vehicle: 'Hyundai Creta',
        registration: 'TN10CD2202',
        location: 'Chennai',
        owner: 'Siva Motors',
        customer: 'Arjun Kumar',
        customer_email: 'customer@siva.test',
      }),
    );
    db.prepare('INSERT INTO notifications (user_id,booking_id,message) VALUES (1,2,?)').run(
      'Your demo Hyundai Creta rental has been approved.',
    );
  });
}
if (process.argv[1]?.endsWith('/seed.js')) {
  const db = openDatabase();
  await seedDemo(db);
  console.log('Demo data ready. Existing data is preserved.');
  db.close();
}
