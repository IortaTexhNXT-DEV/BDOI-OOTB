-- Report catalogue: the trial balance screen path was spelt "Trail Balance".
UPDATE report_definitions SET screen = replace(screen, 'Trail Balance', 'Trial Balance') WHERE screen LIKE '%Trail Balance%';
