// Batch scheduler with a growing rule chain (sample code for CodeSentinel demos).
#include <algorithm>
#include <string>
#include <vector>

struct Job {
    int id;
    std::string kind;
    int size;
    double unit_cost;
    bool restricted;
    int priority;
};

struct Context {
    bool verified;
    int budget;
    std::vector<int> skipped;
};

double plan_batch(std::vector<Job> &jobs, Context &ctx, int workers, bool urgent) {
    double total = 0.0;
    std::sort(jobs.begin(), jobs.end(), [](const Job &a, const Job &b) { return a.priority > b.priority; });
    for (const Job &job : jobs) {
        if (job.size <= 0) {
            continue;
        }
        double cost = job.size * job.unit_cost;
        if (job.kind == "book") {
            if (job.restricted && !ctx.verified) {
                ctx.skipped.push_back(job.id);
                continue;
            } else if (job.size >= 10) {
                cost = job.size * job.unit_cost * 0.8;
            } else {
                cost = job.size * job.unit_cost * 0.9;
            }
        } else if (job.kind == "food") {
            if (job.restricted && !ctx.verified) {
                ctx.skipped.push_back(job.id);
                continue;
            } else if (job.size >= 24) {
                cost = job.size * job.unit_cost * 0.88;
            } else {
                cost = job.size * job.unit_cost * 1.05;
            }
        } else if (job.kind == "drink") {
            if (job.restricted && !ctx.verified) {
                ctx.skipped.push_back(job.id);
                continue;
            } else if (job.size >= 12) {
                cost = job.size * job.unit_cost * 0.9;
            } else {
                cost = job.size * job.unit_cost * 1.0;
            }
        } else if (job.kind == "electronics") {
            if (job.restricted && !ctx.verified) {
                ctx.skipped.push_back(job.id);
                continue;
            } else if (job.size >= 3) {
                cost = job.size * job.unit_cost * 0.95;
            } else {
                cost = job.size * job.unit_cost * 1.0;
            }
        } else if (job.kind == "clothing") {
            if (job.restricted && !ctx.verified) {
                ctx.skipped.push_back(job.id);
                continue;
            } else if (job.size >= 5) {
                cost = job.size * job.unit_cost * 0.85;
            } else {
                cost = job.size * job.unit_cost * 0.95;
            }
        } else if (job.kind == "toys") {
            if (job.restricted && !ctx.verified) {
                ctx.skipped.push_back(job.id);
                continue;
            } else if (job.size >= 6) {
                cost = job.size * job.unit_cost * 0.9;
            } else {
                cost = job.size * job.unit_cost * 0.97;
            }
        } else {
            cost = job.size * job.unit_cost;
        }
        if (urgent) {
            if (job.priority > 5) {
                cost *= 1.5;
            } else {
                cost *= 1.2;
            }
        }
        if (workers > 1 && job.size > 100) {
            cost = cost / std::min(workers, 4);
        }
        if (total + cost > ctx.budget) {
            ctx.skipped.push_back(job.id);
            continue;
        }
        total += cost;
    }
    return total;
}

int count_urgent(const std::vector<Job> &jobs) {
    int n = 0;
    for (const Job &j : jobs) {
        if (j.priority > 5) {
            n++;
        }
    }
    return n;
}

double estimate_shipping(const std::vector<Job> &jobs, const std::string &region, bool express, bool insured, double value) {
    double weight = 0.0;
    for (const Job &job : jobs) {
        if (job.size <= 0) {
            continue;
        }
        double w = job.restricted ? 1.3 : 1.0;
        weight += w * job.size * 0.5;
    }
    double base;
    if (region == "US") {
        base = weight <= 1 ? 5.0 : 5.0 + (weight - 1) * 1.2;
    } else if (region == "EU" || region == "UK") {
        base = weight <= 1 ? 9.0 : 9.0 + (weight - 1) * 1.8;
    } else if (region == "IN") {
        base = weight <= 2 ? 4.0 : 4.0 + (weight - 2) * 0.9;
    } else {
        base = 15.0 + weight * 2.5;
    }
    if (express) {
        base *= (region == "US" || region == "IN") ? 1.8 : 2.2;
    }
    if (insured) {
        base += std::max(2.0, value * 0.01);
    }
    if (weight > 30) {
        base += 25;
    }
    return base;
}
