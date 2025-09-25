document.addEventListener('DOMContentLoaded', function() {
            const navLinks = document.querySelectorAll('.nav-links a, .navbar .logo, .btn');
            const pages = document.querySelectorAll('.page');
            const totalPages = pages.length;

            pages.forEach((page, index) => {
                page.style.zIndex = totalPages - index;
            });

            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    const targetId = link.dataset.target || link.getAttribute('href');
                    
                    // Allow mailto links to work normally
                    if (targetId && targetId.startsWith('mailto:')) {
                        return;
                    }

                    e.preventDefault();
                    handlePageFlip(targetId);
                });
            });
            
            function handlePageFlip(targetId) {
                if (!targetId || !targetId.startsWith('#')) return;

                const targetPage = document.querySelector(targetId);
                if (!targetPage) return;

                let targetIndex = 0;
                for (let i = 0; i < pages.length; i++) {
                    if (pages[i] === targetPage) {
                        targetIndex = i;
                        break;
                    }
                }

                for (let i = 0; i < pages.length; i++) {
                    if (i < targetIndex) {
                        pages[i].classList.add('flipped');
                    } else {
                        pages[i].classList.remove('flipped');
                    }
                }
            }

            // ===== COLORFUL MOUSE TRAIL (SMOKE) EFFECT =====
            document.addEventListener('mousemove', function(e) {
                const trailParticle = document.createElement('span');
                trailParticle.classList.add('mouse-trail');
                document.body.appendChild(trailParticle);

                // --- NEW SMOKE LOGIC ---
                // Generate a random bright HSL color
                const randomHue = Math.floor(Math.random() * 360);
                const particleColor = `hsl(${randomHue}, 100%, 70%)`; // The color

                const randomSize = Math.floor(Math.random() * 20) + 15; // Size between 15px and 35px
                const randomDriftX = (Math.random() - 0.5) * 60; // Random horizontal drift
                const randomDriftY = (Math.random() * -30) - 40; // Random upward drift (mostly up)
                const randomRotation = (Math.random() - 0.5) * 360; // Random rotation

                // Apply styles
                trailParticle.style.width = `${randomSize}px`;
                trailParticle.style.height = `${randomSize}px`;
                
                // Create a radial gradient to look like a puff of smoke (soft edges)
                trailParticle.style.background = `radial-gradient(circle at center, ${particleColor} 0%, rgba(255, 255, 255, 0) 70%)`;

                // Position the particle at the mouse cursor.
                trailParticle.style.left = e.pageX + 'px';
                trailParticle.style.top = e.pageY + 'px';

                // Animate the particle to fade, drift, shrink, and rotate, then remove it
                // We request an animation frame to apply the final state, ensuring the transition triggers
                requestAnimationFrame(() => {
                    setTimeout(() => {
                         // Apply the "out" state for the transition
                        trailParticle.style.transform = `translate(calc(-50% + ${randomDriftX}px), calc(-50% + ${randomDriftY}px)) scale(0.5) rotate(${randomRotation}deg)`;
                        trailParticle.style.opacity = '0';
                    }, 10); // A tiny delay to ensure initial styles are applied before transitioning
                });


                // Remove the particle from the DOM after the animation completes
                setTimeout(() => {
                    trailParticle.remove();
                }, 1210); // Match the transition duration (1200ms) + small delay
            });

            // ===== GEMINI API CALL LOGIC =====
            
            /**
             * Calls the Gemini API to generate test cases based on a project description.
             * Implements exponential backoff for retries.
             * @param {string} description - The project description.
             * @param {number} retries - Number of retry attempts.
             * @param {number} delay - Initial delay in ms for retry.
             * @returns {Promise<string>} - The generated text response.
             */
            async function callGeminiApi(description, retries = 3, delay = 1000) {
                const apiKey = ""; // API key is handled by the environment
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

                const systemPrompt = "You are an expert QA Automation Engineer. Based on the following project description, generate a concise list of 5-7 potential test cases. Categorize them as 'Unit', 'Integration', or 'E2E'. Respond in plain text, using bullet points. Do not use markdown formatting like ** or `.";
                const userQuery = `Project Description: "${description}"`;

                const payload = {
                    contents: [{ parts: [{ text: userQuery }] }],
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                };

                for (let i = 0; i < retries; i++) {
                    try {
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (!response.ok) {
                            // Don't retry on client errors, but do on server errors
                            if (response.status >= 400 && response.status < 500) {
                                throw new Error(`Client error: ${response.status}`);
                            }
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }

                        const result = await response.json();
                        
                        if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0].text) {
                            return result.candidates[0].content.parts[0].text;
                        } else {
                            // Handle cases where response is missing text, e.g., safety blocks
                            if (result.candidates && result.candidates[0].finishReason === 'SAFETY') {
                                return "Could not generate test cases due to safety restrictions.";
                            }
                            throw new Error("Invalid response structure from Gemini API.");
                        }

                    } catch (error) {
                        console.error(`Attempt ${i + 1} failed:`, error.message);
                        if (i === retries - 1) {
                            // Last retry failed
                            throw error;
                        }
                        // Wait before retrying with exponential backoff
                        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
                    }
                }
            }

            // Add event listeners to all Gemini buttons
            document.querySelectorAll('.btn-gemini').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const description = e.target.dataset.description;
                    const projectCard = e.target.closest('.project-content');
                    const loader = projectCard.querySelector('.loader');
                    const responseEl = projectCard.querySelector('.gemini-response');

                    // Show loader and hide old response
                    loader.style.display = 'block';
                    responseEl.style.display = 'none';
                    responseEl.textContent = ''; // Clear previous

                    try {
                        const testCases = await callGeminiApi(description);
                        responseEl.textContent = testCases;
                        responseEl.style.display = 'block';
                    } catch (error) {
                        console.error("Gemini API call failed:", error);
                        responseEl.textContent = "Error generating test cases. Please try again later.";
                        responseEl.style.display = 'block';
                    } finally {
                        // Hide loader
                        loader.style.display = 'none';
                    }
                });
            });

        });