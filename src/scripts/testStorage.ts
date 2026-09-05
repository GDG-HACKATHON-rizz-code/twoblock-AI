import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, serviceKey);

async function testSupabase() {
  console.log('Testing Supabase connection to:', url);
  
  // List storage buckets
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.error('List buckets error:', bErr);
  } else {
    console.log('Existing buckets:', buckets.map(b => b.name));
  }

  // Check if curriculum-resources exists
  const hasCurriculum = buckets?.some(b => b.name === 'curriculum-resources');
  if (!hasCurriculum) {
    console.log('Creating bucket: curriculum-resources (private)');
    const { data: createData, error: cErr } = await supabase.storage.createBucket('curriculum-resources', {
      public: false,
      fileSizeLimit: 52428800 // 50MB
    });
    if (cErr) {
      console.error('Create bucket error:', cErr);
    } else {
      console.log('Bucket created successfully:', createData);
    }
  } else {
    console.log('Bucket curriculum-resources already exists!');
  }
}

testSupabase().catch(console.error);
