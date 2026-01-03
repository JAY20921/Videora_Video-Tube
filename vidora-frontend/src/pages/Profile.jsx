import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchVideos } from '../api/videos';
import { getChannelProfile } from '../api/users';
import VideoCard from '../components/VideoCard';
import Loading from '../components/Loading';

export default function ProfilePage() {
  const { username } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    // fetch channel profile if username provided
    if (username) {
      getChannelProfile(username).then((res) => {
        const data = res?.data ?? res?.channel ?? res;
        if (mounted) setChannel(data);
      }).catch(() => {
        // ignore if protected or not found
      })
    }
    // fetch recent videos and filter by username if available
    fetchVideos({ limit: 24 })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.videos ?? res?.data ?? [];
        const filtered = list.filter((v) => {
          if (!username) return true;
          // owner may be populated; check owner.username or owner?.username
          const owner = v.owner || v;
          return String(owner?.username || '').toLowerCase() === String(username).toLowerCase();
        });
        if (mounted) setVideos(filtered);
      })
      .catch((e) => console.error(e))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [username]);

  // If visiting own profile and not logged in, show message
  if (!user && (!username || (username && username === user?.username))) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-neutral-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold">Profile</h2>
          <p className="text-sm text-neutral-400 mt-3">You are not logged in. Please <button onClick={() => navigate('/login')} className="underline">sign in</button> to view and manage your profile.</p>
        </div>
      </div>
    );
  }

  // If username provided and no user, allow public profile view
  const showEdit = user && user.username === username;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Cover image */}
      <div className="w-full h-44 rounded-lg overflow-hidden mb-4 bg-neutral-800">
        <img src={channel?.coverImage || user?.coverImage || (videos[0]?.owner?.coverImage)} alt="No Image Uploaded!" className="w-full h-full object-cover" />
      </div>

      <div className="bg-neutral-900 p-6 rounded-lg mb-6">
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 -mt-16 rounded-full overflow-hidden border-4 border-neutral-900 bg-neutral-800 flex items-center justify-center">
  {(
    channel?.avatar ||
    user?.avatar ||
    videos[0]?.owner?.avatar
  ) ? (
    <img
      src={channel?.avatar || user?.avatar || videos[0]?.owner?.avatar}
      alt="Avatar"
      className="w-full h-full object-cover"
    />
  ) : (
    <span className="text-white text-2xl font-semibold">
      {(channel?.fullName?.[0] || user?.fullName?.[0] || username?.[0] || 'U').toUpperCase()}
    </span>
  )}
</div>

          <div>
            <h3 className="text-2xl font-semibold">{channel?.fullName || username || user?.fullName || user?.username}</h3>
            <div className="text-sm text-neutral-400">@{channel?.username || user?.username}</div>
            <div className="text-sm text-neutral-400 mt-1">{channel?.subscribersCount ?? '-'} subscribers • {videos.length} videos • {videos.reduce((s, v) => s + (v?.views || 0), 0)} views</div>
          </div>
          <div className="ml-auto">
            {showEdit ? (
              <button onClick={() => navigate('/upload')} className="px-3 py-2 bg-rose-600 rounded">Upload</button>
            ) : (
              <button className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded">Subscribe</button>
            )}
          </div>
        </div>
      </div>

      <section>
        <h4 className="text-lg font-semibold mb-3">Videos</h4>
        {loading ? <Loading /> : videos.length === 0 ? <div className="text-neutral-400">No videos uploaded yet.</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {videos.map(v => <VideoCard key={v._id} video={v} />)}
          </div>
        )}
      </section>
    </div>
  );
}
