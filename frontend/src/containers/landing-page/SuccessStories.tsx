interface SuccessStoriesProps {
  successStoriesBgImage: string;
}

export default function SuccessStories({ successStoriesBgImage }: SuccessStoriesProps) {
  const stories = [
    {
      name: "Sarah Chen",
      location: "San Francisco, CA",
      story: "Saved $200 on phone repairs using RepairCoin tokens earned from previous repairs.",
      tokens: "450 RCN"
    },
    {
      name: "Mike Rodriguez",
      location: "Austin, TX",
      story: "My repair shop joined RepairCoin and saw 30% increase in customer loyalty.",
      tokens: "2,100 RCN"
    },
    {
      name: "Emily Johnson",
      location: "Portland, OR",
      story: "Love being able to use tokens at different shops across the city.",
      tokens: "320 RCN"
    }
  ];

  return (
    <section className="py-16 bg-gray-900 text-white" style={{ backgroundImage: `url(${successStoriesBgImage})` }}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Success Stories</h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Real stories from RepairCoin users who are making a difference.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {stories.map((story, index) => (
            <div key={index} className="bg-gray-800 p-6 rounded-lg">
              <div className="mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-3">
                  <span className="text-white font-bold">{story.name.charAt(0)}</span>
                </div>
                <h3 className="text-lg font-semibold">{story.name}</h3>
                <p className="text-gray-400 text-sm">{story.location}</p>
              </div>
              <p className="text-gray-300 mb-4">&ldquo;{story.story}&rdquo;</p>
              <div className="text-green-400 font-semibold">
                {story.tokens} earned
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}