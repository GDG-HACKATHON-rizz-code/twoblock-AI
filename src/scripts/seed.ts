import { dataStore } from '../services/dataStore.js';

export async function runSeed() {
  console.log('🌱 Starting 2Block Ai database & data store seeding...');

  dataStore.seedFromDemoData();
  dataStore.save();

  console.log(`✅ Seeded ${dataStore.data.users.length} users:`);
  dataStore.data.users.forEach(u => console.log(`   - [${u.role.toUpperCase()}] ${u.name} (${u.email})`));

  console.log(`✅ Seeded ${dataStore.data.subjects.length} core subjects`);
  console.log(`✅ Seeded ${dataStore.data.students.length} class students`);
  console.log(`✅ Seeded ${dataStore.data.classes.length} classes`);
  console.log(`✅ Seeded ${dataStore.data.interventions.length} intervention records`);
  console.log('🎉 Seeding completed successfully!');
}

runSeed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
