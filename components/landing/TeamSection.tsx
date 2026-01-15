"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Linkedin, Instagram } from "lucide-react";

const teamMembers = [
  {
    name: "Ömer Burak Avcıoğlu",
    role: "Co-Founder",
    specialty: "Engineering",
    image: "/team/burak_pic.png",
    initials: "OA",
    color: "#0055FF",
    bio: "Bilkent University Electrical-Electronics Engineering senior student. Successfully graduated from GIGLA (Entrepreneurial Young Leaders Academy) in high school. Organized various events with YES (Young Entrepreneur Society) at university. Transfers the experience gained in product development through numerous projects developed in high school and university to Volina AI.",
    linkedin: "https://www.linkedin.com/in/omerburakavcioglu/",
    instagram: "",
  },
  {
    name: "Fatih Aydın",
    role: "Co-Founder",
    specialty: "Product",
    image: "/team/fatih_pic.png",
    initials: "FA",
    color: "#10B981",
    bio: "Continuing Economics education at the University of Michigan. During high school years in the USA, grew an Instagram account to over 50K followers, gaining strong practical experience in digital marketing, content creation, and sales. Currently, in Ankara, actively supports customer meetings (sales/demos) and social media marketing processes at Volina AI.",
    linkedin: "",
    instagram: "https://www.instagram.com/amerikada_1liseli/",
  },
  {
    name: "Artun Balta",
    role: "Co-Founder",
    specialty: "Development",
    image: "/team/artun_pic.png",
    initials: "AB",
    color: "#F59E0B",
    bio: "Bilkent University Electrical-Electronics Engineering senior student. Works as an EEG/physiological signal processing research assistant at Boğaziçi University MIMLAB. Is a Fellow at the Turkey Entrepreneurship Foundation. In his second venture, Volina, he focuses on product development and operational processes.",
    linkedin: "https://www.linkedin.com/in/artunbalta/",
    instagram: "",
  },
  {
    name: "Berke Pekşen",
    role: "Co-Founder",
    specialty: "Design",
    image: "/team/berke_pic.png",
    initials: "BP",
    color: "#8B5CF6",
    bio: "Hacettepe University Industrial Engineering graduate. Works as a Production Planning Engineer at ASELSAN. Gained product and team-oriented work experience by developing various projects for competitions like TEKNOFEST. At Volina AI, aims to strengthen operational processes by transferring project management and planning discipline to the team.",
    linkedin: "https://www.linkedin.com/in/berke-pek%C5%9Fen-02b838229",
    instagram: "",
  },
];

export function TeamSection() {
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  const toggleFlip = (memberName: string) => {
    setFlippedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberName)) {
        newSet.delete(memberName);
      } else {
        newSet.add(memberName);
      }
      return newSet;
    });
  };

  return (
    <section id="team" className="py-24 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Meet the Team
          </h2>
        </div>

        {/* Team grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {teamMembers.map((member, index) => {
            const isFlipped = flippedCards.has(member.name);
            
            return (
              <div
                key={member.name}
                className="relative h-[400px]"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  perspective: "1000px",
                }}
              >
                <div
                  className="relative w-full h-full transition-transform duration-500 cursor-pointer"
                  onClick={() => toggleFlip(member.name)}
                  style={{
                    transformStyle: "preserve-3d",
                    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Front of card */}
                  <Card 
                    className="absolute inset-0 w-full h-full overflow-hidden bg-gray-900/50 hover:bg-gray-900/70 border-gray-800 hover:border-blue-500/30 transition-all duration-300 backface-hidden"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                  >
                    <CardContent className="p-6 h-full flex flex-col justify-center">
                      {/* Avatar */}
                      <div className="flex justify-center mb-6">
                        <div 
                          className="relative"
                          style={{ 
                            filter: `drop-shadow(0 4px 20px ${member.color}30)` 
                          }}
                        >
                          <Avatar className="w-24 h-24 ring-4 ring-gray-800 overflow-hidden">
                            <AvatarImage 
                              src={member.image} 
                              alt={member.name}
                              className="object-cover w-full h-full"
                              style={{ 
                                objectFit: 'cover',
                                objectPosition: member.name === "Berke Pekşen" ? "55% center" : "center center"
                              }}
                            />
                            <AvatarFallback 
                              className="text-xl font-bold text-white"
                              style={{ backgroundColor: member.color }}
                            >
                              {member.initials}
                            </AvatarFallback>
                          </Avatar>
                          {/* Specialty badge */}
                          <div 
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium text-white whitespace-nowrap"
                            style={{ backgroundColor: member.color }}
                          >
                            {member.specialty}
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="text-center">
                        <h3 className="text-xl font-semibold text-white mb-1">
                          {member.name}
                        </h3>
                        <p className="text-sm text-blue-400 font-medium mb-4">
                          {member.role}
                        </p>

                        {/* Social links */}
                        <div className="flex justify-center gap-3">
                          {member.linkedin && member.linkedin !== "" && (
                            <a 
                              href={member.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors"
                              aria-label={`${member.name} LinkedIn`}
                            >
                              <Linkedin className="w-4 h-4" />
                            </a>
                          )}
                          {member.instagram && member.instagram !== "" && (
                            <a 
                              href={member.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 text-white/40 hover:text-pink-400 hover:bg-pink-500/10 rounded-full transition-colors"
                              aria-label={`${member.name} Instagram`}
                            >
                              <Instagram className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Back of card */}
                  <Card 
                    className="absolute inset-0 w-full h-full overflow-hidden bg-gray-900/50 border-gray-800"
                    style={{
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <CardContent className="p-6 h-full flex flex-col justify-center">
                      <div className="text-center mb-4">
                        <h3 className="text-xl font-semibold text-white mb-2">
                          {member.name}
                        </h3>
                        <p className="text-sm text-blue-400 font-medium mb-4">
                          {member.role}
                        </p>
                      </div>
                      <div className="flex-1 flex items-center">
                        <p className="text-sm text-white/80 leading-relaxed text-center">
                          {member.bio}
                        </p>
                      </div>
                      <div className="mt-4 flex justify-center gap-3">
                        {member.linkedin && member.linkedin !== "" && (
                          <a 
                            href={member.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors"
                            aria-label={`${member.name} LinkedIn`}
                          >
                            <Linkedin className="w-4 h-4" />
                          </a>
                        )}
                        {member.instagram && member.instagram !== "" && (
                          <a 
                            href={member.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-white/40 hover:text-pink-400 hover:bg-pink-500/10 rounded-full transition-colors"
                            aria-label={`${member.name} Instagram`}
                          >
                            <Instagram className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

